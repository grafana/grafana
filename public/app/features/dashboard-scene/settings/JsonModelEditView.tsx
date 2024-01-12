import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Button, CodeEditor, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { Trans } from 'app/core/internationalization';
import { getPrettyJSON } from 'app/features/inspector/utils/utils';

import { DashboardScene } from '../scene/DashboardScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';

export interface JsonModelEditViewState extends DashboardEditViewState {}

export class JsonModelEditView extends SceneObjectBase<JsonModelEditViewState> implements DashboardEditView {
  public getUrlKey(): string {
    return 'json-model';
  }

  public getDashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getJsonText(): string {
    const dashboard = this.getDashboard();
    const jsonData = transformSceneToSaveModel(dashboard);
    return getPrettyJSON(jsonData);
  }

  static Component = ({ model }: SceneComponentProps<JsonModelEditView>) => {
    const jsonText = model.getJsonText();
    const dashboard = model.getDashboard();
    const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
    const canSave = dashboard.useState().meta.canSave;

    const styles = useStyles2(getStyles);

    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <div className={styles.wrapper}>
          <Trans i18nKey="dashboard-settings.json-editor.subtitle">
            The JSON model below is the data structure that defines the dashboard. This includes dashboard settings,
            panel settings, layout, queries, and so on.
          </Trans>
          <CodeEditor
            width="100%"
            value={jsonText}
            language="json"
            showLineNumbers={true}
            showMiniMap={true}
            containerStyles={styles.codeEditor}
          />
          {canSave && (
            <div>
              {/**TODO: add saving functionality */}
              <Button type="submit">
                <Trans i18nKey="dashboard-settings.json-editor.save-button">Save changes</Trans>
              </Button>
            </div>
          )}
        </div>
      </Page>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    height: '100%',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  codeEditor: css({
    flexGrow: 1,
  }),
});
