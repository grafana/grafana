export function formatTimestamp(timestamp?: number) {
  if (!timestamp) {
    return 'N/A';
  }
  return new Date(timestamp).toLocaleString();
}
