export interface PlatformProps {
  isConnected?: boolean;
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
