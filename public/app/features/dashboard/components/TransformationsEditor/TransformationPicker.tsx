import { css } from '@emotion/css';
import { FormEventHandler, KeyboardEventHandler, ReactNode } from 'react';

import { DocsId, GrafanaTheme2, TransformerRegistryItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Card, Container, VerticalGroup, Alert, Input, useStyles2 } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
import { getDocsLink } from 'app/core/utils/docsLinks';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';

const LOCAL_STORAGE_KEY = 'dashboard.components.TransformationEditor.featureInfoBox.isDismissed';

interface TransformationPickerProps {
  noTransforms: boolean;
  search: string;
  onSearchChange: FormEventHandler<HTMLInputElement>;
  onSearchKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onTransformationAdd: Function;
  suffix: ReactNode;
  xforms: TransformerRegistryItem[];
}

export function TransformationPicker(props: TransformationPickerProps) {
  const { noTransforms, search, xforms, onSearchChange, onSearchKeyDown, onTransformationAdd, suffix } = props;

  return (
    <VerticalGroup>
      {noTransforms && (
        <Container grow={1}>
          <LocalStorageValueProvider<boolean> storageKey={LOCAL_STORAGE_KEY} defaultValue={false}>
            {(isDismissed, onDismiss) => {
              if (isDismissed) {
                return null;
              }

              return (
                <Alert
                  title="Transformations"
                  severity="info"
                  onRemove={() => {
                    onDismiss(true);
                  }}
                >
                  <p>
                    Transformations allow you to join, calculate, re-order, hide, and rename your query results before
                    they are visualized. <br />
                    Many transforms are not suitable if you&apos;re using the Graph visualization, as it currently only
                    supports time series data. <br />
                    It can help to switch to the Table visualization to understand what a transformation is doing.{' '}
                  </p>
                  <a
                    href={getDocsLink(DocsId.Transformations)}
                    className="external-link"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read more
                  </a>
                </Alert>
              );
            }}
          </LocalStorageValueProvider>
        </Container>
      )}
      <Input
        data-testid={selectors.components.Transforms.searchInput}
        value={search ?? ''}
        autoFocus={!noTransforms}
        placeholder="Search for transformation"
        onChange={onSearchChange}
        onKeyDown={onSearchKeyDown}
        suffix={suffix}
      />
      {xforms.map((t) => {
        return (
          <TransformationCard
            key={t.name}
            transform={t}
            onClick={() => {
              onTransformationAdd({ value: t.id });
            }}
          />
        );
      })}
    </VerticalGroup>
  );
}

interface TransformationCardProps {
  transform: TransformerRegistryItem;
  onClick: () => void;
}

function TransformationCard({ transform, onClick }: TransformationCardProps) {
  const styles = useStyles2(getStyles);
  return (
    <Card
      className={styles.card}
      data-testid={selectors.components.TransformTab.newTransform(transform.name)}
      onClick={onClick}
    >
      <Card.Heading>{transform.name}</Card.Heading>
      <Card.Description>{transform.description}</Card.Description>
      {transform.state && (
        <Card.Tags>
          <PluginStateInfo state={transform.state} />
        </Card.Tags>
      )}
    </Card>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    card: css({
      margin: '0',
      padding: `${theme.spacing(1)}`,
    }),
  };
}
