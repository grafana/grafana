import { css } from '@emotion/css';
import { type ComponentPropsWithoutRef, forwardRef, type PropsWithChildren, useState } from 'react';

import { type AppPluginConfig, type ComponentDescriptor, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Card, Icon, Modal, Stack, Text, useStyles2 } from '@grafana/ui';

interface CardProps {
  entry: ComponentDescriptor;
  provider?: AppPluginConfig;
  excerpt?: boolean;
}

export function DataSourceComponentCard({ entry, provider, excerpt = false, children }: PropsWithChildren<CardProps>) {
  const styles = useStyles2(getStyles);
  const [modalTitle, setModalTitle] = useState<string | null>(null);
  const logo = provider?.info?.logos?.small;
  const useInPages = t('datasources.components.use-in-pages', 'Use in a Page');
  const useInAssistant = t('datasources.components.use-in-assistant', 'Use in Assistant');

  return (
    <li>
      <Card className={styles.card} noMargin>
        <Card.Figure align="center" className={styles.figure}>
          {logo ? <img src={logo} alt="" /> : <Icon name="apps" size="lg" />}
        </Card.Figure>
        <Card.Heading>{entry.title}</Card.Heading>
        <Card.Meta>
          {t('datasources.components.provider', 'Provided by {{name}}', { name: provider?.name || entry.pluginId })}
        </Card.Meta>
        <Card.Description>
          <Stack direction="column" gap={1}>
            {entry.description && (
              <div className={excerpt ? styles.descriptionExcerpt : undefined}>{entry.description}</div>
            )}
            <Stack direction="column" gap={0.5}>
              <Text variant="bodySmall" weight="medium" color="secondary">
                <Trans i18nKey="datasources.instance-components.prompt">Prompt</Trans>
              </Text>
              <pre className={styles.prompt}>
                <code className={excerpt ? styles.promptExcerpt : undefined}>{entry.prompt}</code>
              </pre>
            </Stack>
          </Stack>
        </Card.Description>
        <Card.Actions>
          {children}
          <Button
            icon="pages"
            size="sm"
            variant="secondary"
            fill="outline"
            aria-haspopup="dialog"
            tooltip={useInPages}
            onClick={() => setModalTitle(useInPages)}
          >
            <Trans i18nKey="datasources.components.pages">Pages</Trans>
          </Button>
          <Button
            icon="ai-sparkle"
            size="sm"
            variant="secondary"
            fill="outline"
            aria-haspopup="dialog"
            tooltip={useInAssistant}
            onClick={() => setModalTitle(useInAssistant)}
          >
            <Trans i18nKey="datasources.components.assistant">Assistant</Trans>
          </Button>
        </Card.Actions>
      </Card>
      {modalTitle && (
        <Modal title={modalTitle} isOpen onDismiss={() => setModalTitle(null)}>
          <Text element="p">
            <Trans i18nKey="datasources.components.not-implemented">Not implemented yet.</Trans>
          </Text>
        </Modal>
      )}
    </li>
  );
}

export const DataSourceComponentGrid = forwardRef<HTMLUListElement, ComponentPropsWithoutRef<'ul'>>((props, ref) => {
  const styles = useStyles2(getStyles);
  return <ul {...props} ref={ref} className={styles.grid} role="list" />;
});

DataSourceComponentGrid.displayName = 'DataSourceComponentGrid';

const getStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gap: theme.spacing(1.5),
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${theme.spacing(44)}), 1fr))`,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  card: css({
    height: '100%',
    gridTemplate: `
      "Figure Heading" auto
      "Figure Meta" auto
      "Description Description" 1fr
      "Actions Actions" auto / auto minmax(0, 1fr)
    `,
    overflowWrap: 'anywhere',
  }),
  figure: css({
    display: 'grid',
    placeItems: 'center',
    width: theme.spacing(5),
    height: theme.spacing(5),
    marginRight: theme.spacing(1.5),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    '> img': {
      width: theme.spacing(3),
      height: theme.spacing(3),
      objectFit: 'contain',
    },
  }),
  descriptionExcerpt: css({
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
    alignSelf: 'start',
  }),
  prompt: css({
    margin: 0,
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.secondary,
    wordBreak: 'normal',
    overflowWrap: 'anywhere',
    code: { margin: 0 },
  }),
  promptExcerpt: css({
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
    overflow: 'hidden',
  }),
});
