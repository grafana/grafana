import { locationService } from '@grafana/runtime';
import { payloads } from 'app/features/dashboard-scene/mutation-api/commands/schemas';
import type { MutationClient, MutationResult } from 'app/features/dashboard-scene/mutation-api/types';

interface PreviewSession {
  planId: string;
  origin: string;
  client?: MutationClient;
}

const previewPath = '/dashboard/new';

/** Owns navigation for the process-wide mutation API's single on-page plan preview. */
export class DashboardPlanPreview {
  private active?: PreviewSession;

  constructor(private getDashboardClient: () => MutationClient | null) {}

  onClientDeactivated(client: MutationClient): void {
    if (this.active?.client === client) {
      this.active = undefined;
    }
  }

  async render(payload: unknown): Promise<MutationResult> {
    const parsed = payloads.renderPlan.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message, changes: [] };
    }

    const location = locationService.getLocation();
    const previousClient = this.getDashboardClient();
    const previous =
      location.pathname === previewPath && this.active && (!this.active.client || this.active.client === previousClient)
        ? this.active
        : undefined;
    const session: PreviewSession = {
      planId: parsed.data.planId,
      origin: previous?.origin ?? `${location.pathname}${location.search}${location.hash}`,
      client: previous?.client,
    };
    this.active = session;

    try {
      if (!session.client) {
        locationService.replace(
          `${previewPath}?title=${encodeURIComponent(parsed.data.title)}&editSource=plan-preview`
        );
        session.client = await this.waitForDashboard(
          session,
          location.pathname === previewPath ? null : previousClient
        );
      }

      if (this.active !== session || !this.isCurrentPage(session)) {
        throw new Error('The dashboard plan preview was cancelled.');
      }

      const result = await session.client.execute({ type: 'RENDER_PLAN', payload: parsed.data });
      if (!result.success) {
        this.restoreAfterFailure(session);
      }
      return result;
    } catch (error) {
      this.restoreAfterFailure(session);
      return { success: false, error: error instanceof Error ? error.message : String(error), changes: [] };
    }
  }

  async end(payload: unknown): Promise<MutationResult> {
    const parsed = payloads.endPlanning.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message, changes: [] };
    }

    const session = this.active;
    const client = this.getDashboardClient();
    if (
      !session ||
      session.planId !== parsed.data.planId ||
      session.client !== client ||
      !client ||
      !this.isCurrentPage(session)
    ) {
      return { success: false, error: 'The preview dashboard is no longer open.', changes: [] };
    }

    const result = await client.execute({ type: 'END_PLANNING', payload: parsed.data });
    if (result.success && this.active === session) {
      this.active = undefined;
      if (parsed.data.restoreUserLocation && this.isCurrentPage(session)) {
        locationService.replace(session.origin);
      }
    }
    return result;
  }

  private async waitForDashboard(
    session: PreviewSession,
    previousClient: MutationClient | null
  ): Promise<MutationClient> {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (this.active !== session || locationService.getLocation().pathname !== previewPath) {
        throw new Error('The dashboard plan preview was cancelled.');
      }
      const client = this.getDashboardClient();
      if (client && client !== previousClient) {
        return client;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Timed out waiting for the dashboard plan preview to open.');
  }

  private isCurrentPage(session: PreviewSession): boolean {
    return (
      locationService.getLocation().pathname === previewPath &&
      (!session.client || session.client === this.getDashboardClient())
    );
  }

  private restoreAfterFailure(session: PreviewSession): void {
    if (this.active !== session) {
      return;
    }
    this.active = undefined;
    if (this.isCurrentPage(session)) {
      locationService.replace(session.origin);
    }
  }
}
