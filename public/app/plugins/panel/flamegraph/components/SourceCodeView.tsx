import React from 'react';
import { useAsync } from 'react-use';

import { CodeLocation, SourceCodeAPI } from 'app/plugins/datasource/phlare/types';

type Props = {
  datasource: SourceCodeAPI;
  location: CodeLocation;
  className?: string;
};

export const SourceCodeView = (props: Props) => {
  const result = useAsync(() => props.datasource.getSourceCode(props.location));
  // TODO use result

  return (
    <div className={props.className}>
      <pre>Hello World;</pre>
    </div>
  );
};
