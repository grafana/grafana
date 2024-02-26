import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, Scope, ScopeDashboard, SelectableValue } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { IconButton, Select, useStyles2 } from '@grafana/ui';

export interface ScopeSelectorSceneState extends SceneObjectState {
  isExpanded: boolean;

  scopes: Scope[];
  isScopesLoading: boolean;

  pendingValue: string | undefined;
  value: string | undefined;

  dashboards: ScopeDashboard[];
  isDashboardsLoading: boolean;
}

export class ScopeSelectorScene extends SceneObjectBase<ScopeSelectorSceneState> {
  static Component = ScopeSelectorSceneRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scope'] });

  constructor() {
    super({
      isExpanded: false,

      scopes: [],
      isScopesLoading: true,

      pendingValue: undefined,
      value: undefined,

      dashboards: [],
      isDashboardsLoading: false,
    });

    this.addActivationHandler(() => {
      this.fetchScopes();
    });
  }

  getUrlState() {
    return { scope: this.state.value };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    this.setScope(values.scope as string | undefined);
  }

  public getSelectedScope(): Scope | undefined {
    return this.state.scopes.find((scope) => scope.uid === this.state.value);
  }

  public toggle() {
    this.setState({ isExpanded: !this.state.isExpanded });
  }

  public setScope(newScope: string | undefined) {
    if (this.state.isScopesLoading) {
      return this.setState({ pendingValue: newScope });
    }

    if (!this.state.scopes.find((scope) => scope.uid === newScope)) {
      newScope = undefined;
    }

    this.setState({ value: newScope });
  }

  private async fetchScopes() {
    this.setState({ isScopesLoading: true });

    setTimeout(() => {
      this.setScopesAfterFetch([
        {
          uid: '9842607e-d7aa-4338-8a23-25610e266db8',
          title: 'Scope 1',
          type: 'scope1',
          description: '',
          category: 'Category 1',
          filters: [],
        },
        {
          uid: '27973258-11b8-4ffa-9b4a-c864bf53555f',
          title: 'Scope 2',
          type: 'scope2',
          description: '',
          category: 'Category 2',
          filters: [],
        },
        {
          uid: 'cd69e0a7-166e-414a-a85d-cb91a03ad282',
          title: 'Scope 3',
          type: 'scope3',
          description: '',
          category: 'Category 1',
          filters: [],
        },
        {
          uid: '79216d99-22c8-488c-9f85-227099acf5ae',
          title: 'Scope 4',
          type: 'scope4',
          description: '',
          category: 'Category 3',
          filters: [],
        },
        {
          uid: '11f25259-8234-496e-94ad-d51600787acb',
          title: 'Scope 5',
          type: 'scope5',
          description: '',
          category: 'Category 2',
          filters: [],
        },
        {
          uid: '4afb3b52-5b6b-4c74-b58a-e29095847063',
          title: 'Scope 6',
          type: 'scope6',
          description: '',
          category: 'Category 1',
          filters: [],
        },
      ]);

      this.setState({ isScopesLoading: false });
    }, 500);
  }

  private setScopesAfterFetch(scopes: Scope[]) {
    let value = this.state.pendingValue ?? this.state.value;

    if (!scopes.find((scope) => scope.uid === value)) {
      value = undefined;
    }

    this.setState({ scopes, pendingValue: undefined, value });

    this.fetchDashboards(value);
  }

  private async fetchDashboards(scope: string | undefined = this.state.value) {
    if (!scope) {
      return this.setState({ dashboards: [], isDashboardsLoading: false });
    }

    this.setState({ isDashboardsLoading: true });

    setTimeout(() => {
      this.setState({
        dashboards: [
          {
            uid: '20a5aec7-8381-4c91-94b7-4e8d17c75672',
            title: 'My Dashboard 1',
          },
          {
            uid: 'c677f72a-ab93-4442-b50f-367f4a2849c7',
            title: 'My Dashboard 2',
          },
        ],
        isDashboardsLoading: false,
      });
    }, 500);
  }
}

export function ScopeSelectorSceneRenderer({ model }: SceneComponentProps<ScopeSelectorScene>) {
  const { isExpanded, scopes, isScopesLoading, value } = model.useState();
  const styles = useStyles2(getStyles);

  if (isScopesLoading) {
    return null;
  }

  const options: Array<SelectableValue<string>> = scopes.map(({ uid, title, category }) => ({
    label: title,
    value: uid,
    description: category,
  }));

  return (
    <div className={cx(styles.container, isExpanded && styles.containerExpanded)}>
      <div className={cx(styles.topContainer, isExpanded && styles.topContainerExpanded)}>
        <IconButton
          name="arrow-to-right"
          aria-label={isExpanded ? 'Collapse scope filters' : 'Expand scope filters'}
          className={cx(!isExpanded && styles.iconNotExpanded)}
          onClick={() => model.toggle()}
        />
        <Select
          isClearable
          options={options}
          value={value}
          onChange={(selectableValue) => model.setScope(selectableValue?.value ?? undefined)}
        />
      </div>
      {isExpanded && <div className={styles.bottomContainer}></div>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      alignItems: 'baseline',
      flex: theme.spacing(40),
      gap: theme.spacing(1),
    }),
    containerExpanded: css({
      backgroundColor: theme.colors.background.primary,
    }),
    topContainer: css({
      display: 'flex',
      flexDirection: 'row',
    }),
    topContainerExpanded: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(2),
    }),
    bottomContainer: css({
      padding: theme.spacing(2),
    }),
    iconNotExpanded: css({
      transform: 'scaleX(-1)',
    }),
  };
};
