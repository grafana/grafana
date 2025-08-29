import { Token } from 'prismjs';

import { LogListModel } from './processing';

export const HighlightedLogRenderer = ({ log }: { log: LogListModel }) => {
  return (
    <>
      {log.highlightedBodyTokens.map((token, i) => (
        <LogToken token={token} key={i} />
      ))}
    </>
  );
};

const LogToken = ({ token }: { token: Token | string }) => {
  if (typeof token === 'string') {
    return token;
  }
  if (Array.isArray(token.content)) {
    return (
      <span className={`token ${token.type}`}>
        {token.content.map((subToken, i) => (
          <LogToken key={i} token={subToken} />
        ))}
      </span>
    );
  }
  return (
    <span className={`token ${token.type}`}>
      {typeof token.content === 'string' ? token.content : <LogToken token={token.content} />}
    </span>
  );
};
