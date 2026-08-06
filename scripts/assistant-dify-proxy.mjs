#!/usr/bin/env node
/**
 * Local proxy for Dify Chat + Whisper STT.
 * Keeps the API key server-side and avoids browser CORS issues.
 *
 * Usage:
 *   1. Copy .dify.env.example → .dify.env and set DIFY_API_KEY
 *   2. node scripts/assistant-dify-proxy.mjs
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = resolve(root, '.dify.env');

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(envPath);

const PORT = Number(process.env.DIFY_PROXY_PORT || 3456);
const API_BASE = (process.env.DIFY_API_BASE || 'https://api.dify.ai/v1').replace(/\/$/, '');
const API_KEY = process.env.DIFY_API_KEY || '';
const EMBED_BASE = (process.env.DIFY_EMBED_BASE || 'https://udify.app').replace(/\/$/, '');
const EMBED_TOKEN = process.env.DIFY_EMBED_TOKEN || '';
const EMBED_URL =
  process.env.DIFY_EMBED_URL || (EMBED_TOKEN ? `${EMBED_BASE}/chatbot/${EMBED_TOKEN}` : '');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, status, body) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function proxyJson(path, body) {
  if (!API_KEY) {
    return {
      status: 500,
      data: {
        message:
          'DIFY_API_KEY is not set. Create a Chatbot app at https://cloud.dify.ai, copy its API key into .dify.env, and restart this proxy.',
      },
    };
  }

  const upstream = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await upstream.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text || `Upstream error ${upstream.status}` };
  }
  return { status: upstream.status, data };
}

async function proxyAudioToText(body) {
  if (!API_KEY) {
    return {
      status: 500,
      data: {
        message:
          'DIFY_API_KEY is not set. Create a Chatbot app at https://cloud.dify.ai, copy its API key into .dify.env, and restart this proxy.',
      },
    };
  }

  const form = new FormData();
  const bytes = Buffer.from(body.audioBase64, 'base64');
  const mimeType = body.mimeType || 'audio/wav';
  const filename = body.filename || 'recording.wav';
  const blob = new Blob([bytes], { type: mimeType });
  form.append('file', blob, filename);
  form.append('user', body.user || 'grafana-user');

  const upstream = await fetch(`${API_BASE}/audio-to-text`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  });

  const text = await upstream.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text || `Upstream error ${upstream.status}` };
  }
  return { status: upstream.status, data };
}

const server = createServer(async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      apiBase: API_BASE,
      hasApiKey: Boolean(API_KEY),
      hasEmbedToken: Boolean(EMBED_URL),
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/embed-config') {
    sendJson(res, 200, {
      embedUrl: EMBED_URL,
      hasEmbedToken: Boolean(EMBED_URL),
      embedBase: EMBED_BASE,
    });
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/info' || url.pathname === '/parameters')) {
    if (!API_KEY) {
      sendJson(res, 500, { message: 'DIFY_API_KEY is not set' });
      return;
    }
    try {
      const upstream = await fetch(`${API_BASE}${url.pathname}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      const text = await upstream.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text || `Upstream error ${upstream.status}` };
      }
      sendJson(res, upstream.status, data);
    } catch (err) {
      sendJson(res, 500, { message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  try {
    if (req.method === 'POST' && url.pathname === '/chat-messages') {
      const raw = await readBody(req);
      const body = JSON.parse(raw.toString('utf8') || '{}');
      const { status, data } = await proxyJson('/chat-messages', body);
      sendJson(res, status, data);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/audio-to-text') {
      const raw = await readBody(req);
      const body = JSON.parse(raw.toString('utf8') || '{}');
      const { status, data } = await proxyAudioToText(body);
      sendJson(res, status, data);
      return;
    }

    sendJson(res, 404, { message: 'Not found' });
  } catch (err) {
    sendJson(res, 500, { message: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`[assistant-dify-proxy] listening on http://localhost:${PORT}`);
  console.log(`[assistant-dify-proxy] Dify API: ${API_BASE}`);
  console.log(`[assistant-dify-proxy] API key: ${API_KEY ? 'configured' : 'MISSING — set DIFY_API_KEY in .dify.env'}`);
  console.log(
    `[assistant-dify-proxy] Embed: ${
      EMBED_URL ? 'configured' : 'MISSING — set DIFY_EMBED_TOKEN or DIFY_EMBED_URL in .dify.env (Publish → Embed)'
    }`
  );
});
