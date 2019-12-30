import { Observable } from 'rxjs';
import { WebSocketSrv, WebSocketConnectionOptions, SocketMessage } from '@grafana/runtime';

export class GrafanaLiveSrv implements WebSocketSrv {
  subscribe(options: WebSocketConnectionOptions): Observable<SocketMessage> {
    throw new Error('Method not implemented.');
  }

  write(msg: SocketMessage): SocketMessage {
    throw new Error('Method not implemented.');
  }
}
