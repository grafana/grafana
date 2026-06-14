import type { DashboardScene } from '../scene/DashboardScene';
import type { UserActionsService } from '../user-actions/UserActionsService';

import type { ClientCommand, ClientCommandContext, ClientCommandResult } from './ClientCommand';

/**
 * Agent-facing entry point for dashboard mutations.
 *
 * Receives a ClientCommand and a raw payload, then delegates to the command's
 * handler which validates, maps, and routes into UserActionsService.
 */
export class MutationApiClient {
  private scene: DashboardScene;
  private userActionsService: UserActionsService;

  constructor(scene: DashboardScene, userActionsService: UserActionsService) {
    this.scene = scene;
    this.userActionsService = userActionsService;
  }

  async execute<T>(clientCommand: ClientCommand<T>, payload: T): Promise<ClientCommandResult> {
    const context: ClientCommandContext = {
      scene: this.scene,
      userActionsService: this.userActionsService,
    };
    return clientCommand.handler(payload, context);
  }
}
