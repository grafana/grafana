export function getClientTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch(e) {
    return 'Etc/UTC'
  }
}
