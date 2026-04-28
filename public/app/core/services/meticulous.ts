import { getFeatureFlagClient, FlagKeys } from '@grafana/runtime/internal';

const AUTH_PATH_PREFIXES = ['/login', '/signup', '/invite/', '/verify', '/user/password/'];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function updateMeticulousRecording(pathname: string): Promise<void> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaMeticulousAIRecorder, false)) {
    return;
  }

  if (isAuthPath(pathname)) {
    const { stopIntercepting } = await import('@alwaysmeticulous/recorder-loader');
    await stopIntercepting();
  } else {
    const { tryLoadAndStartRecorder } = await import('@alwaysmeticulous/recorder-loader');
    await tryLoadAndStartRecorder({ isProduction: true, recordingToken: window.__METICULOUS_AI_RECORDING_TOKEN__  });
  }
}
