import React, { useState } from 'react';
import { useStyles2, Icon } from '@grafana/ui';
import { getStyles } from './styles';
import { CodeBlockWithCopyProps } from './types';

export const CodeBlockWithCopy = ({ code, className }: CodeBlockWithCopyProps) => {
  const styles = useStyles2(getStyles);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`${styles.codeBlock} ${className || ''}`}>
      <pre>{code}</pre>
      <button className={styles.copyButton} onClick={handleCopy}>
        {copied ? (
          <>
            <Icon name="check" className={styles.checkIcon} /> Copied
          </>
        ) : (
          <>
            <Icon name="copy" className={styles.copyIcon} /> Copy
          </>
        )}
      </button>
    </div>
  );
};
