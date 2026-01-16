/**
 * Service to control live streaming behavior from dashboard settings.
 * Used by dashboard scene to signal when live streaming should be blocked,
 * and by CentrifugeService to check if streaming should start.
 */
class BlockLiveStreamingService {
  private blocked = false;

  /**
   * Set whether live streaming should be blocked.
   * Called by dashboard when connectLiveToAutoRefresh is enabled and auto-refresh is Off.
   */
  setBlocked(blocked: boolean): void {
    this.blocked = blocked;
  }

  /**
   * Check if live streaming is currently blocked.
   */
  isBlocked(): boolean {
    return this.blocked;
  }
}

export const blockLiveStreamingService = new BlockLiveStreamingService();
