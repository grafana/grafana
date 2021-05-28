import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { PageToolbar, withErrorBoundary, useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { fetchExistingRuleAction } from './state/actions';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { parseRuleIdentifier } from './utils/rules';

type ViewAlertRuleProps = GrafanaRouteComponentProps<{ id?: string }>;

const ViewAlertRulePage: FC<ViewAlertRuleProps> = ({ match }) => {
  const id = match.params.id;
  const { loading, result, error, dispatched } = useUnifiedAlertingSelector((state) => state.ruleForm.existingRule);
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  const identifier = getIdentifier(id);
  useEffect(() => {
    if (!dispatched && identifier) {
      dispatch(fetchExistingRuleAction(identifier));
    }
  }, [dispatched, dispatch, identifier]);

  if (!identifier) {
    return <div>no rule</div>;
  }

  if (!result) {
    return <div>no alert rule</div>;
  }

  console.log(result);

  return (
    <div className={styles.pageWrapper}>
      <Page>
        <PageToolbar title={result.group.name} pageIcon="bell" />
        <Page.Contents>view alert</Page.Contents>
      </Page>
    </div>
  );
};

const getIdentifier = (id: string | undefined) => {
  if (!id) {
    return undefined;
  }

  return parseRuleIdentifier(decodeURIComponent(id));
};

const getStyles = (theme: GrafanaTheme2) => ({
  pageWrapper: css`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  `,
  content: css`
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.borderRadius()};
    margin: ${theme.spacing(0, 2, 2)};
  `,
});

export default withErrorBoundary(ViewAlertRulePage, { style: 'page' });
