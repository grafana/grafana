import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ConditionalRenderingUserTeamKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Field, MultiSelect, RadioButtonGroup, Stack, Text } from '@grafana/ui';

import { dashboardEditActions } from '../../edit-pane/shared';

import { getLowerTranslatedObjectType } from '../object';

import { ConditionalRenderingConditionWrapper } from './ConditionalRenderingConditionWrapper';
import { ConditionRegistryItem } from './conditionRegistry';
import { checkGroup, getObjectType } from './utils';

type UserTeamOperator = 'is_member' | 'is_not_member';

interface ConditionalRenderingUserTeamState extends SceneObjectState {
  operator: UserTeamOperator;
  teamUids: string[];
  result: boolean | undefined;
}

interface TeamInfo {
  uid: string;
  name: string;
}

/**
 * Evaluates whether the signed-in user belongs (or does not belong) to
 * one or more specified teams. Uses the /api/user/teams endpoint.
 */
export class ConditionalRenderingUserTeam extends SceneObjectBase<ConditionalRenderingUserTeamState> {
  public static Component = ConditionalRenderingUserTeamRenderer;

  public static registryItem: ConditionRegistryItem = {
    id: 'ConditionalRenderingUserTeam',
    name: 'User team',
    description: 'Check if the current user belongs to specific teams',
    deserialize: (model) =>
      ConditionalRenderingUserTeam.deserialize(model as ConditionalRenderingUserTeamKind),
    createEmpty: () =>
      new ConditionalRenderingUserTeam({ operator: 'is_member', teamUids: [], result: undefined }),
    isApplicable: () => true,
  };

  private _userTeamUids: string[] | null = null;

  public constructor(state: ConditionalRenderingUserTeamState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this._fetchUserTeams();
  }

  private async _fetchUserTeams() {
    try {
      const rawTeams = await getBackendSrv().get('/api/user/teams');
      console.debug('[UserTeamCondition] Raw /api/user/teams response:', JSON.stringify(rawTeams));
      const teams: TeamInfo[] = rawTeams;
      this._userTeamUids = teams.map((t) => t.uid);
      console.debug('[UserTeamCondition] Extracted user team UIDs:', this._userTeamUids);
    } catch (err) {
      console.error('[UserTeamCondition] Failed to fetch user teams:', err);
      this._userTeamUids = [];
    }
    this._evaluate();
  }

  private _evaluate() {
    console.debug('[UserTeamCondition] _evaluate called', {
      userTeamUids: this._userTeamUids,
      configuredTeamUids: this.state.teamUids,
      operator: this.state.operator,
      currentResult: this.state.result,
    });

    if (this._userTeamUids === null || this.state.teamUids.length === 0) {
      // Haven't fetched yet or no teams configured -- result is undefined
      console.debug('[UserTeamCondition] Early return: userTeamUids is null or no configured teams');
      if (this.state.result !== undefined) {
        this.setState({ result: undefined });
        checkGroup(this);
      }
      return;
    }

    const isMember = this.state.teamUids.some((uid) => {
      const found = this._userTeamUids!.includes(uid);
      console.debug(`[UserTeamCondition] Checking configured UID "${uid}" in user teams: ${found}`);
      return found;
    });
    const result = this.state.operator === 'is_member' ? isMember : !isMember;

    console.debug('[UserTeamCondition] Evaluation result:', { isMember, operator: this.state.operator, result });

    if (result !== this.state.result) {
      console.debug('[UserTeamCondition] Result changed, updating state from', this.state.result, 'to', result);
      this.setState({ result });
      checkGroup(this);
    }
  }

  public changeOperator(operator: UserTeamOperator) {
    if (this.state.operator !== operator) {
      this.setState({ operator });
      this._evaluate();
    }
  }

  public changeTeamUids(teamUids: string[]) {
    this.setState({ teamUids });
    this._evaluate();
  }

  public renderCmp(): ReactElement {
    return <this.Component model={this} key={this.state.key} />;
  }

  public serialize(): ConditionalRenderingUserTeamKind {
    return {
      kind: 'ConditionalRenderingUserTeam',
      spec: {
        operator: this.state.operator,
        teamUids: this.state.teamUids,
      },
    };
  }

  public static deserialize(model: ConditionalRenderingUserTeamKind): ConditionalRenderingUserTeam {
    return new ConditionalRenderingUserTeam({
      operator: model.spec.operator,
      teamUids: model.spec.teamUids,
      result: undefined,
    });
  }
}

// ─── Renderer ──────────────────────────────────────────────────────

function ConditionalRenderingUserTeamRenderer({
  model,
}: SceneComponentProps<ConditionalRenderingUserTeam>) {
  const { operator, teamUids } = model.useState();
  const [allTeams, setAllTeams] = useState<TeamInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all teams in the org so the user can pick from them
  useEffect(() => {
    let cancelled = false;

    async function fetchTeams() {
      try {
        const response = await getBackendSrv().get('/api/teams/search', { perpage: 1000, page: 1 });
        if (!cancelled) {
          setAllTeams(response.teams ?? []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  const teamOptions = useMemo<Array<SelectableValue<string>>>(
    () =>
      allTeams.map((t) => ({
        label: t.name,
        value: t.uid,
      })),
    [allTeams]
  );

  const selectedTeams = useMemo(
    () => teamUids.map((uid) => teamOptions.find((o) => o.value === uid) ?? { label: uid, value: uid }),
    [teamUids, teamOptions]
  );

  const handleOperatorChange = useCallback(
    (newOperator: UserTeamOperator) => {
      dashboardEditActions.edit({
        description: 'Change user team condition operator',
        source: model,
        perform: () => model.changeOperator(newOperator),
        undo: () => model.changeOperator(operator),
      });
    },
    [model, operator]
  );

  const handleTeamsChange = useCallback(
    (options: Array<SelectableValue<string>>) => {
      const newUids = options.map((o) => o.value!).filter(Boolean);
      const prevUids = teamUids;

      dashboardEditActions.edit({
        description: 'Change user team condition teams',
        source: model,
        perform: () => model.changeTeamUids(newUids),
        undo: () => model.changeTeamUids(prevUids),
      });
    },
    [model, teamUids]
  );

  return (
    <ConditionalRenderingConditionWrapper
      info={`Show or hide the ${getLowerTranslatedObjectType(getObjectType(model))} based on the current user's team membership.`}
      isObjectSupported={true}
      model={model}
      title="User team"
    >
      <Stack direction="column" gap={1}>
        <Field label="Operator" noMargin>
          <RadioButtonGroup
            options={[
              { label: 'Is member of', value: 'is_member' as const },
              { label: 'Is not member of', value: 'is_not_member' as const },
            ]}
            value={operator}
            onChange={handleOperatorChange}
          />
        </Field>
        <Field label="Teams" noMargin>
          <MultiSelect
            options={teamOptions}
            value={selectedTeams}
            onChange={handleTeamsChange}
            placeholder={loading ? 'Loading teams...' : 'Select teams...'}
            isLoading={loading}
            isClearable
            closeMenuOnSelect={false}
          />
        </Field>
        {teamUids.length > 0 && (
          <Text variant="bodySmall" color="secondary">
            {operator === 'is_member'
              ? `User must be a member of at least one of ${teamUids.length} selected team(s)`
              : `User must not be a member of any of ${teamUids.length} selected team(s)`}
          </Text>
        )}
      </Stack>
    </ConditionalRenderingConditionWrapper>
  );
}

