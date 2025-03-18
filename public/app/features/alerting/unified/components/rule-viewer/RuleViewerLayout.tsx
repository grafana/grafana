import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { PageProps } from 'app/core/components/Page/types';

type Props = {
  children: React.ReactNode | React.ReactNode[];
  title: string;
  renderTitle?: PageProps['renderTitle'];
  wrapInContent?: boolean;
};

const defaultPageNav: Partial<NavModelItem> = {
  icon: 'bell',
  id: 'alert-rule-view',
};

export function RuleViewerLayout(props: Props): JSX.Element | null {
  const { wrapInContent = true, children, title, renderTitle } = props;
  const styles = useStyles2(getPageStyles);

  return (
    <Page pageNav={{ ...defaultPageNav, text: title }} renderTitle={renderTitle} navId="alert-list">
      <Page.Contents>
        <div className={styles.content}>{wrapInContent ? <RuleViewerLayoutContent {...props} /> : children}</div>
      </Page.Contents>
    </Page>
  );
}

type ContentProps = {
  children: React.ReactNode | React.ReactNode[];
  padding?: number;
};

export function RuleViewerLayoutContent({ children, padding = 2 }: ContentProps): JSX.Element | null {
  const styles = useStyles2(getContentStyles(padding));
  return <div className={styles.wrapper}>{children}</div>;
}

const getPageStyles = (theme: GrafanaTheme2) => {
  return {
    content: css({
      maxWidth: `${theme.breakpoints.values.xxl}px`,
    }),
  };
};

const getContentStyles = (padding: number) => (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(padding),
    }),
  };
};
