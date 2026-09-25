import { isEqual } from 'lodash';

import { t } from '@grafana/i18n';
import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
import { type DashboardScene } from '../scene/DashboardScene';
import { getDashboardResourceText, validateDashboardResourceEnvelope } from '../sidebar/codePaneUtils';
import { dashboardV2SpecSchema } from '../v2schema/dashboardV2Schema';

import { mergeDashboardCode, type CodeConflict, type CodeResolution } from './mergeDashboardCode';

interface CodeSessionState extends SceneObjectState {
  text: string;
  baseline: string;
  error?: string;
  hasParseError?: boolean;
  incoming?: string;
  conflicts: CodeConflict[];
  resolutions: Record<string, CodeResolution>;
}

export class DashboardCodeSession extends SceneObjectBase<CodeSessionState> {
  constructor() {
    super({ text: '', baseline: '', conflicts: [], resolutions: {} });
  }

  public hasChanges() {
    return Boolean(this.state.hasParseError) || this.state.text !== this.state.baseline;
  }

  public reset(dashboard: DashboardScene) {
    const text = getDashboardResourceText(dashboard);
    this.setState({
      text,
      baseline: text,
      hasParseError: false,
      error: undefined,
      incoming: undefined,
      conflicts: [],
      resolutions: {},
    });
  }

  public setParseError = (hasParseError: boolean) => {
    if (hasParseError !== Boolean(this.state.hasParseError)) {
      this.setState({ hasParseError });
    }
  };

  public updateText(text: string) {
    this.setState({ text, hasParseError: false, error: undefined, resolutions: {} });
    if (this.state.incoming) {
      this.mergeIncoming(this.state.incoming);
    }
  }

  public sync(dashboard: DashboardScene) {
    this.mergeIncoming(getDashboardResourceText(dashboard));
  }

  private mergeIncoming(incoming: string) {
    const base = JSON.parse(this.state.baseline);
    const latest = JSON.parse(incoming);
    if (isEqual(base, latest)) {
      if (this.state.incoming) {
        this.setState({ incoming: undefined, conflicts: [], resolutions: {} });
      }
      return;
    }
    if (this.state.hasParseError) {
      this.setState({ incoming, conflicts: [], resolutions: {} });
      return;
    }
    let local: unknown;
    try {
      local = JSON.parse(this.state.text);
    } catch {
      this.setState({ incoming, conflicts: [], resolutions: {} });
      return;
    }
    const { value, conflicts } = mergeDashboardCode(base, local, latest);
    if (conflicts.length) {
      this.setState({
        incoming,
        conflicts,
        resolutions: incoming === this.state.incoming ? this.state.resolutions : {},
      });
    } else {
      this.setState({
        text: isEqual(value, latest) ? incoming : JSON.stringify(value, null, 2),
        baseline: incoming,
        incoming: undefined,
        conflicts: [],
        resolutions: {},
        error: undefined,
      });
    }
  }

  public chooseResolution(path: string, choice: CodeResolution) {
    this.setState({ resolutions: { ...this.state.resolutions, [path]: choice } });
  }

  public finishReview(dashboard: DashboardScene): boolean {
    // Recheck the live dashboard so a newer Assistant update cannot be overwritten.
    this.sync(dashboard);
    const { baseline, text, incoming, conflicts, resolutions } = this.state;
    if (!incoming || !conflicts.length || conflicts.some(({ path }) => !resolutions[path])) {
      return false;
    }
    const { value } = mergeDashboardCode(JSON.parse(baseline), JSON.parse(text), JSON.parse(incoming), resolutions);
    this.setState({
      text: isEqual(value, JSON.parse(incoming)) ? incoming : JSON.stringify(value, null, 2),
      baseline: incoming,
      incoming: undefined,
      conflicts: [],
      resolutions: {},
      error: undefined,
    });
    return true;
  }

  public getValidationError(dashboard: DashboardScene, text: string): string | undefined {
    try {
      this.parseValidatedSpec(dashboard, text);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private parseValidatedSpec(dashboard: DashboardScene, text = this.state.text) {
    const resource = JSON.parse(text);
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
      throw new Error(t('dashboard.modes.code.resource', 'Expected a dashboard resource object.'));
    }
    const envelope = validateDashboardResourceEnvelope(dashboard, resource);
    if (!envelope.success) {
      throw new Error(envelope.error);
    }
    const parsed = dashboardV2SpecSchema.safeParse(resource.spec);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
    }
    const dropped = findChangedInput(resource.spec, parsed.data, 'spec');
    const extra = Object.keys(resource).find((key) => !['apiVersion', 'kind', 'metadata', 'spec'].includes(key));
    if (dropped || extra) {
      throw new Error(
        t(
          'dashboard.modes.code.unsupported',
          'Unsupported value at {{path}}. It would be lost or changed when applied.',
          { path: dropped ?? extra }
        )
      );
    }
    return parsed.data;
  }

  public apply(dashboard: DashboardScene): boolean {
    if (this.state.hasParseError) {
      return false;
    }
    this.sync(dashboard);
    if (!this.hasChanges()) {
      return true;
    }
    try {
      if (!dashboard.canEditDashboard() || dashboard.managedResourceCannotBeEdited()) {
        throw new Error(t('dashboard.modes.code.permission', 'You cannot edit this dashboard.'));
      }
      const resource = JSON.parse(this.state.text);
      const baseline = JSON.parse(this.state.baseline);
      if (isEqual(resource, baseline)) {
        this.reset(dashboard);
        return true;
      }
      if (this.state.conflicts.length) {
        throw new Error(
          t('dashboard.modes.code.conflict', 'The dashboard changed. Review conflicting code changes before applying.')
        );
      }
      const spec = this.parseValidatedSpec(dashboard);
      applyDashboardSpec({
        scene: dashboard,
        spec,
        description: t('dashboard.modes.code.undo', 'Edit dashboard code'),
      });
      this.reset(dashboard);
      return true;
    } catch (error) {
      this.setState({ error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
}

// Defaults and null collections may normalize, but authored fields must never disappear silently.
function findChangedInput(input: unknown, output: unknown, path: string): string | undefined {
  if (input === null && (Array.isArray(output) || (output && typeof output === 'object'))) {
    return undefined;
  }
  if (input && typeof input === 'object' && output && typeof output === 'object') {
    for (const [key, value] of Object.entries(input)) {
      if (!(key in output)) {
        return `${path}.${key}`;
      }
      const changed = findChangedInput(value, Reflect.get(output, key), `${path}.${key}`);
      if (changed) {
        return changed;
      }
    }
    return undefined;
  }
  return isEqual(input, output) ? undefined : path;
}
