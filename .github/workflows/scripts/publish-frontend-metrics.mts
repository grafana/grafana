import fs from 'node:fs'

interface Payload {
  name: string;
  value: number;
  interval: number;
  mtype: string;
  time: number;
}

console.log("Publishing metrics");

// Get API key from environment variable
const key = process.env.GRAFANA_MISC_STATS_API_KEY;
if (!key) {
  throw new Error("API key is required. Provide it via the GRAFANA_MISC_STATS_API_KEY environment variable");
}

const unixTimestamp = Math.floor(Date.now() / 1000);
const data: Payload[] = [];

const input = fs.readFileSync(0, "utf-8");
// parse metrics from input
const regexp = /^Metrics: (\{.+\})/ms;
const matches = input.match(regexp);

if (!matches) {
  throw new Error("No metrics found");
}

console.log('matches[0]', matches[0])
console.log('matches[1]', matches[1])

const metrics: Record<string, string> = JSON.parse(matches[1]);

// Convert metrics to payload format
for (const [metricName, valueStr] of Object.entries(metrics)) {
  const value = parseInt(valueStr, 10);
  if (isNaN(value)) {
    throw new Error(`Metric "${metricName}" has invalid value format: "${valueStr}"`);
  }

  data.push({
    name: metricName,
    value: value,
    interval: 60,
    mtype: "gauge",
    time: unixTimestamp,
  });
}

const jsonPayload = JSON.stringify(data);
console.log(`Publishing metrics to https://<user>:<pass>@graphite-us-central1.grafana.net/metrics, JSON: ${jsonPayload}`);

const url = 'https://graphite-us-central1.grafana.net/metrics';
const username = '6371';
const headers = new Headers();
headers.set("Content-Type", "application/json");
headers.set('Authorization', 'Basic ' + Buffer.from(username + ":" + key).toString('base64'));

try {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: jsonPayload,
  });

  if (!response.ok) {
    throw new Error(`Metrics publishing failed with status code ${response.status}`);
  }

  console.log("Metrics successfully published");
} catch (error) {
  throw new Error(`Metrics publishing failed: ${error instanceof Error ? error.message : String(error)}`);
}
