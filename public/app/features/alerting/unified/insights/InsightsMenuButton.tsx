import { css } from '@emotion/css';
import { useState } from 'react';

import { ExploreUrlState, GrafanaTheme2, serializeStateToUrlParam, toURLRange } from '@grafana/data';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneTimeRangeState,
  SceneVariableSetState,
  sceneGraph,
} from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { Button, Dropdown, Icon, IconButton, Menu, Modal, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { trackInsightsFeedback } from '../Analytics';

type DataQueryWithExpr = DataQuery & { expr: string };

const getPrometheusExploreUrl = ({
  queries,
  range,
  variables,
}: {
  queries?: DataQueryWithExpr[];
  range: SceneTimeRangeState;
  variables: SceneVariableSetState;
}): string => {
  // In Mimir-per-group panels, replace `$rule_group` in the query expression with the actual rule group value
  const ruleGroup = variables?.variables.find((v) => v.state.name === 'rule_group')?.getValue() || null;
  if (ruleGroup !== null) {
    queries = queries?.map((query) => {
      return {
        ...query,
        expr: query.expr.replace('$rule_group', String(ruleGroup)),
      };
    });
  }
  const urlState: ExploreUrlState = {
    datasource: (queries?.length && queries[0].datasource?.uid) || null,
    queries:
      queries?.map(({ expr, refId }, i) => {
        return { expr, refId };
      }) || [],
    range: toURLRange(range ? { from: range.from, to: range.to } : { from: 'now-1h', to: 'now' }),
  };

  const param = encodeURIComponent(serializeStateToUrlParam(urlState));

  return `/explore?left=${param}`;
};

const InsightsMenuButtonRenderer = ({ model }: SceneComponentProps<InsightsMenuButton>) => {
  const data = sceneGraph.getData(model).useState();
  const timeRange = sceneGraph.getTimeRange(model).useState();
  const variables = sceneGraph.getVariables(model).useState();
  const panel = model.state.panel;

  const url = getPrometheusExploreUrl({
    queries: data.data?.request?.targets as DataQueryWithExpr[],
    range: timeRange,
    variables: variables,
  });

  const styles = useStyles2(getStyles);

  const [showModal, setShowModal] = useState<boolean>(false);

  const onDismiss = () => {
    setShowModal(false);
  };

  const onButtonClick = (useful: boolean) => {
    trackInsightsFeedback({ useful, panel: panel });
    onDismiss();
  };

  const modal = (
    <Modal
      title={t('alerting.insights-menu-button-renderer.modal.title-rate-this-panel', 'Rate this panel')}
      isOpen={showModal}
      onDismiss={onDismiss}
      onClickBackdrop={onDismiss}
      className={styles.container}
    >
      <div>
        <p>
          <Trans i18nKey="alerting.insights-menu-button-renderer.help-us">
            Help us improve this page by telling us whether this panel is useful to you!
          </Trans>
        </p>
        <div className={styles.buttonsContainer}>
          <Button variant="secondary" className={styles.buttonContainer} onClick={() => onButtonClick(false)}>
            <div className={styles.button}>
              <Icon name="thumbs-up" className={styles.thumbsdown} size="xxxl" />
              <span>{`I don't like it`}</span>
            </div>
          </Button>
          <Button variant="secondary" className={styles.buttonContainer} onClick={() => onButtonClick(true)}>
            <div className={styles.button}>
              <Icon name="thumbs-up" size="xxxl" />
              <span>
                <Trans i18nKey="alerting.insights-menu-button-renderer.modal.i-like-it">I like it</Trans>
              </span>
            </div>
          </Button>
        </div>
      </div>
    </Modal>
  );

  const menu = (
    <Menu>
      <Menu.Item
        label={t('alerting.insights-menu-button-renderer.menu.label-explore', 'Explore')}
        icon="compass"
        url={url}
        target="_blank"
      />
      <Menu.Item
        label={t('alerting.insights-menu-button-renderer.menu.label-rate-this-panel', 'Rate this panel')}
        icon="comment-alt-message"
        onClick={() => setShowModal(true)}
      />
    </Menu>
  );

  return (
    <div>
      <Dropdown overlay={menu} placement="bottom-start">
        <IconButton
          name="ellipsis-v"
          variant="secondary"
          className={styles.menu}
          aria-label={t('alerting.insights-menu-button-renderer.aria-label-rate-this-panel', 'Rate this panel')}
        />
      </Dropdown>
      {modal}
    </div>
  );
};

interface InsightsMenuButtonState extends SceneObjectState {
  panel: string;
}

export class InsightsMenuButton extends SceneObjectBase<InsightsMenuButtonState> {
  static Component = InsightsMenuButtonRenderer;
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttonsContainer: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: '25px',
  }),
  buttonContainer: css({
    height: '150px',
    width: '150px',
    cursor: 'pointer',
    justifyContent: 'center',
  }),
  button: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  container: css({
    maxWidth: '370px',
  }),
  menu: css({
    height: '25px',
    margin: '0',
  }),
  thumbsdown: css({
    transform: 'scale(-1, -1);',
  }),
});
