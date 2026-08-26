/**
 * Fun, creative dashboard prompt suggestions for the "Surprise Me!" feature.
 * These are designed to inspire users and showcase interesting monitoring scenarios.
 */
export const surprisePrompts = [
  'Coffee machine metrics: cups brewed per hour, temperature, and bean inventory levels',
  'Office plants health monitoring: soil moisture, light levels, and watering schedule',
  'Pizza delivery performance: order times, driver locations, and customer satisfaction',
  'Rubber duck debugging effectiveness: questions asked vs bugs solved correlation',
  'Remote team vibes: video call quality, emoji usage, and virtual background creativity',
  'Code review thoroughness: comment depth, approval speed, and emoji reactions',
  'CI/CD pipeline health with a focus on flaky tests and retry patterns',
  'API error rates visualized as a weather map with storms for outages',
  'Database query performance showing the slowest queries as a race track',
  'Cache hit rates displayed as a basketball shot chart',
  'Kubernetes pod lifecycle events shown as a city traffic map',
  'Message queue depths illustrated as water levels in connected tanks',
  'Service mesh latency heatmap organized by time of day and service',
  'Feature flag adoption rates with rollout waves visualization',
  'User session durations grouped by entry point and device type',
  'Serverless function cold starts vs warm starts comparison',
  'Container image pull times and registry availability',
  'Load balancer distribution fairness across backend instances',
  'Certificate expiration timeline with renewal windows',
  'Disk space usage trends with growth rate predictions',
  'Network bandwidth utilization during peak vs off-peak hours',
  'Authentication success rates broken down by method and geography',
  'Background job execution times and failure retry patterns',
  'CDN cache performance across different regions',
  'Rate limiting triggers and backpressure indicators',
] as const;

/**
 * Returns a random prompt from the surprisePrompts array.
 */
export function getRandomSurprisePrompt(): string {
  const randomIndex = Math.floor(Math.random() * surprisePrompts.length);
  return surprisePrompts[randomIndex];
}
