import { css } from '@emotion/css';
import Prism from 'prismjs';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/plugin-ui';
import { Button, useStyles2 } from '@grafana/ui';

import 'prismjs/components/prism-kusto';
import 'prismjs/themes/prism-tomorrow.min.css';

interface KQLPreviewProps {
  query: string;
  hidden: boolean;
  setHidden: React.Dispatch<React.SetStateAction<boolean>>;
}

const KQLPreview: React.FC<KQLPreviewProps> = ({ query, hidden, setHidden }) => {
  const styles = useStyles2(getStyles);

  useEffect(() => {
    Prism.highlightAll();
  }, [query]);

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Query Preview">
          <>
            <Button hidden={!hidden} variant="secondary" onClick={() => setHidden(false)} size="sm">
              show
            </Button>
            <div className={styles.codeBlock} hidden={hidden}>
              <pre className={styles.code}>
                <code className="language-kusto">{query}</code>
              </pre>
            </div>
            <Button hidden={hidden} variant="secondary" onClick={() => setHidden(true)} size="sm">
              hide
            </Button>
          </>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    codeBlock: css({
      width: '100%',
      display: 'table',
      tableLayout: 'fixed',
    }),
    code: css({
      marginBottom: '4px',
    }),
  };
};

export default KQLPreview;
