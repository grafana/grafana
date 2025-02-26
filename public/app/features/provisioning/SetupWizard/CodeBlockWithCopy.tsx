import { useState } from 'react';
import { useStyles2, Button } from '@grafana/ui';
import { css } from '@emotion/css';

interface Props {
  code: string;
  className?: string;
  copyCode?: boolean;
}

export const CodeBlockWithCopy = ({ code, className, copyCode = true }: Props) => {
  const customStyles = useStyles2(getCustomStyles);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`${customStyles.codeBlockContainer} ${className || ''}`}>
      <pre className={customStyles.pre}>{code}</pre>
      {copyCode && (
        <Button
          size="sm"
          icon={copied ? 'check' : 'copy'}
          onClick={handleCopy}
          className={customStyles.copyButton}
          variant="secondary"
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      )}
    </div>
  );
};

const getCustomStyles = () => {
  return {
    codeBlockContainer: css`
      position: relative;
      background: #141619;
      border-radius: 4px;
      border: 1px solid #222426;
      margin: 16px 0;
      min-height: 60px;
      width: 100%;
    `,
    pre: css`
      font-family: monospace;
      padding: 12px 16px;
      margin: 0;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      min-height: 60px;
      max-height: 300px;
      overflow-y: auto;
      color: #d8d9da;
      font-size: 14px;
      line-height: 1.5;
    `,
    copyButton: css`
      position: absolute;
      top: 8px;
      right: 8px;
    `,
  };
};
