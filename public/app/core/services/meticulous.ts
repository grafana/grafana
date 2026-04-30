const AUTH_PATH_PREFIXES = ['/login', '/signup', '/invite/', '/verify', '/user/password/'];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// if we ever hit an auth path, stop recording and never restart it.
export async function updateMeticulousRecording(pathname: string): Promise<void> {
  if (window.__meticulous == undefined) {
    return;
  }

  // we assume the recorder was enabled by default
  if (!isAuthPath(pathname)) {
    return;
  }

  try {
    window.__meticulous.stopRecording();
  } catch (error) {
    console.error('Error stopping Meticulous recording:', error);
  }
}
