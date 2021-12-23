export interface PlatformProps {
  isConnected?: boolean;
  getSettings: () => void;
}

export interface ConnectProps {
  getSettings: () => void;
}

export interface ConnectedProps {
  getSettings: () => void;
}

export interface ConnectRenderProps {
  pmmServerName: string;
  email: string;
  password: string;
}

export interface ConnectRequest {
  server_name: string;
  email: string;
  password: string;
}
