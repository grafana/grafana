export const PlatformService = {
  connect(): Promise<void> {
    return Promise.resolve();
  },
  disconnect(): Promise<void> {
    return Promise.resolve();
  },
  forceDisconnect(): Promise<void> {
    return Promise.resolve();
  },
  getServerInfo(): Promise<{ pmm_server_id: string; pmm_server_name: string }> {
    return Promise.resolve({ pmm_server_id: '', pmm_server_name: '' });
  },
};
