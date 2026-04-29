import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type ViteDevServer } from 'vite';

const OUTPUT_CAP_BYTES = 256 * 1024;
const JEST_TIMEOUT_MS = 60 * 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeRegex(s: string): string {
  return s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function isPathInsideRoot(candidate: string, root: string): boolean {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function capOutput(buf: string): string {
  if (buf.length <= OUTPUT_CAP_BYTES) {
    return buf;
  }
  return `…(truncated, showing last ${OUTPUT_CAP_BYTES} chars)\n${buf.slice(-OUTPUT_CAP_BYTES)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function narrowString(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  return typeof v === 'string' ? v : undefined;
}

function narrowBool(o: Record<string, unknown>, key: string): boolean | undefined {
  const v = o[key];
  return typeof v === 'boolean' ? v : undefined;
}

const throwErr = (statusCode: number, error: string, res: ServerResponse) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error }));
};

const capStream = (d: Buffer, out: string) => {
  out += d.toString('utf8');
  if (out.length > OUTPUT_CAP_BYTES * 2) {
    out.slice(-OUTPUT_CAP_BYTES * 2);
  }
  return out;
};

const buildJestCommand = (testName: string, updateSnapshot: boolean, testPath: string) => {
  const pattern = `^${escapeRegex(testName)}$`;

  const args = ['jest'];
  if (updateSnapshot) {
    args.push('--updateSnapshot');
  }
  args.push(JSON.stringify(`--testNamePattern ${pattern} -- ${testPath}`));
  const jestCommand = `${args.join(' ')}`;
  return { args, jestCommand };
};

function acceptSnapshotPlugin(): { name: string; configureServer: (server: ViteDevServer) => void } {
  const repoRoot = path.resolve(__dirname, '..', '..');

  return {
    name: 'compare-accept-snapshot',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/compare/test', async (req, res) => {
        if (req.method !== 'POST') {
          throwErr(405, 'Method not allowed', res);
          return;
        }

        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch {
          throwErr(400, 'Invalid JSON body', res);
          return;
        }

        if (!isRecord(body)) {
          throwErr(400, 'Invalid payload', res);
          return;
        }

        const testPath = narrowString(body, 'testPath');
        const testName = narrowString(body, 'testName');
        const updateSnapshot = narrowBool(body, 'updateSnapshot') ?? true;

        if (!testPath || !testName) {
          throwErr(400, 'Invalid testPath or testName', res);
          return;
        }

        if (!path.isAbsolute(testPath) || !isPathInsideRoot(testPath, repoRoot) || !existsSync(testPath)) {
          throwErr(400, 'Invalid testPath', res);
          return;
        }

        const yarnBinary = 'yarn';
        const { args, jestCommand } = buildJestCommand(testName, updateSnapshot, testPath);
        const command = `${yarnBinary} ${jestCommand}`;

        const child = spawn(yarnBinary, args, {
          cwd: repoRoot,
          env: {
            ...process.env,
            // Vite sets NODE_ENV=development; jest must run as test or i18n and other code paths differ.
            NODE_ENV: 'test',
            // Lets `toMatchCanvasSnapshot` rewrite compare payload JSON even when the assertion passes.
            GEN_CANVAS_OUTPUT_ON_PASS: '1',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (d) => (stdout = capStream(d, stdout)));
        child.stderr?.on('data', (d) => (stderr = capStream(d, stderr)));

        const exitCode: number = await new Promise((resolve) => {
          let settled = false;
          const finish = (code: number) => {
            if (settled) {
              return;
            }
            settled = true;
            clearTimeout(t);
            resolve(code);
          };
          const t = setTimeout(() => {
            child.kill('SIGTERM');
            finish(-1);
          }, JEST_TIMEOUT_MS);
          child.once('close', (code) => finish(code ?? -1));
          child.once('error', () => finish(-1));
        });

        const ok = exitCode === 0;
        const payload = {
          ok,
          exitCode,
          stdout: capOutput(stdout),
          stderr: capOutput(stderr),
          command,
          ...(exitCode === -1 ? { error: 'jest timed out or failed to spawn' } : {}),
        };

        // Success!
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), acceptSnapshotPlugin()],
});
