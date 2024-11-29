/* eslint-disable */
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneObjectRef } from '@grafana/scenes';
import { Box, Button, CodeEditor, Drawer, useStyles2 } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';

interface SchemaV2EditorDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  jsonText: string;
}

export class SchemaV2EditorDrawer extends SceneObjectBase<SchemaV2EditorDrawerState> {
  constructor(state: Omit<SchemaV2EditorDrawerState, 'jsonText'>) {
    super({
      ...state,
      jsonText: '',
    });

    this.addActivationHandler(() => this.setState({ jsonText: this.getJsonText() }));
  }

  private getJsonText(): string {
    const dashboard = this.state.dashboardRef.resolve();
    return JSON.stringify(transformSceneToSaveModelSchemaV2(dashboard), null, 2);
  }

  public onClose = () => {
    this.state.dashboardRef.resolve().setState({ overlay: undefined });
  };

  private onSave = () => {
    // TODO: uncomment when transformation is available
    // const manager = getDashboardScenePageStateManager();
    // const dashboard = transformSceneToSaveModelSchemaV2({
    //   dashboard: JSON.parse(this.state.jsonText),
    //   meta: this.state.dashboardRef.resolve().state.meta,
    // });
    // manager.setState({
    //   dashboard,
    // });
  };

  static Component = ({ model }: SceneComponentProps<SchemaV2EditorDrawer>) => {
    const { jsonText } = model.useState();
    const styles = useStyles2(getStyles);

    const renderBody = () => {
      return (
        <div className={styles.wrapper}>
          <CodeEditor
            width="100%"
            value={jsonText}
            language="json"
            showLineNumbers={true}
            showMiniMap={true}
            containerStyles={styles.codeEditor}
            onBlur={(value) => model.setState({ jsonText: value })}
          />
          <Box paddingTop={2}>
            {
              <Button onClick={model.onSave} disabled>
                Update dashboard
              </Button>
            }
          </Box>
        </div>
      );
    };

    return (
      <Drawer
        title={'[DEV] Schema V2 editor'}
        subtitle={'Allows editing dashboard using v2 schema. Changes are not persited in db.'}
        onClose={model.onClose}
      >
        {renderBody()}
      </Drawer>
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
/* eslint-enable */
