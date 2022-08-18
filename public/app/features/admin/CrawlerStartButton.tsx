import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv, config } from '@grafana/runtime';
import { Button, CodeEditor, Modal, useTheme2 } from '@grafana/ui';

export const CrawlerStartButton = () => {
  const styles = getStyles(useTheme2());
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState({
    mode: 'thumbs',
    theme: config.theme2.isLight ? 'light' : 'dark',
  });
  const onDismiss = () => setOpen(false);
  const doStart = () => {
    getBackendSrv()
      .post('/api/admin/crawler/start', body)
      .then((v) => {
        console.log('GOT', v);
        onDismiss();
      });
  };

  return (
    <>
      <Modal title={'Start crawler'} isOpen={open} onDismiss={onDismiss}>
        <div className={styles.wrap}>
          <CodeEditor
            height={200}
            value={JSON.stringify(body, null, 2) ?? ''}
            showLineNumbers={false}
            readOnly={false}
            language="json"
            showMiniMap={false}
            onBlur={(text: string) => {
              setBody(JSON.parse(text)); // force JSON?
            }}
          />
        </div>
        <Modal.ButtonRow>
          <Button type="submit" onClick={doStart}>
            Start
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            Cancel
          </Button>
        </Modal.ButtonRow>
      </Modal>

      <Button onClick={() => setOpen(true)} variant="primary">
        Start
      </Button>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrap: css`
      border: 2px solid #111;
    `,
  };
};
