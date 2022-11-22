export interface ConnectRenderProps {
  pmmServerName: string;
  pmmServerId: string;
  accessToken: string;
}

export interface ConnectRequest {
  server_name: string;
  personal_access_token: string;
}

export interface ConnectErrorBody {
  error: string;
  code: number;
  message: string;
}
