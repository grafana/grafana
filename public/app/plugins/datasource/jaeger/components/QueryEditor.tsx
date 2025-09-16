import { css } from '@emotion/css';
import { useState } from 'react';

import { QueryEditorProps } from '@grafana/data';
import {
  Button,
  FileDropzone,
  InlineField,
  InlineFieldRow,
  Stack,
  Modal,
  QueryField,
  RadioButtonGroup,
  useStyles2,
  useTheme2,
} from '@grafana/ui';

import { JaegerDatasource } from '../datasource';
import { JaegerQuery, JaegerQueryType } from '../types';

import { SearchForm } from './SearchForm';

type Props = QueryEditorProps<JaegerDatasource, JaegerQuery>;

export function QueryEditor({ datasource, query, onChange, onRunQuery }: Props) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const onChangeQuery = (value: string) => {
    const nextQuery: JaegerQuery = { ...query, query: value };
    onChange(nextQuery);
  };

  const renderEditorBody = () => {
    switch (query.queryType) {
      case 'search':
        return <SearchForm datasource={datasource} query={query} onChange={onChange} />;
      case 'dependencyGraph':
        return null;
      default:
        return (
          <InlineFieldRow>
            <InlineField label="Trace ID" labelWidth={14} grow>
              <QueryField
                query={query.query}
                onChange={onChangeQuery}
                onRunQuery={onRunQuery}
                placeholder={'Enter a Trace ID (run with Shift+Enter)'}
                portalOrigin="jaeger"
              />
            </InlineField>
          </InlineFieldRow>
        );
    }
  };

  return (
    <>
      <Modal title={'Upload trace'} isOpen={uploadModalOpen} onDismiss={() => setUploadModalOpen(false)}>
        <div className={css({ padding: theme.spacing(2) })}>
          <FileDropzone
            options={{ multiple: false }}
            onLoad={(result) => {
              datasource.uploadedJson = result;
              onChange({
                ...query,
                queryType: 'upload',
              });
              setUploadModalOpen(false);
              onRunQuery();
            }}
          />
        </div>
      </Modal>
      <div className={styles.container}>
        <InlineFieldRow>
          <InlineField label="Query type" grow={true}>
            <Stack gap={1} alignItems="center" justifyContent="space-between">
              <RadioButtonGroup<JaegerQueryType>
                options={[
                  { value: 'search', label: 'Search' },
                  { value: undefined, label: 'TraceID' },
                  { value: 'dependencyGraph', label: 'Dependency graph' },
                ]}
                value={query.queryType}
                onChange={(v) =>
                  onChange({
                    ...query,
                    queryType: v,
                  })
                }
                size="md"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setUploadModalOpen(true);
                }}
              >
                Import trace
              </Button>
            </Stack>
          </InlineField>
        </InlineFieldRow>
        {renderEditorBody()}
      </div>
    </>
  );
}

const getStyles = () => ({
  container: css({
    width: '100%',
  }),
});
