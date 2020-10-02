declare module 'dangerously-set-html-content' {
  import React from 'react';

  interface DangerouslySetHtmlContentProps extends React.HTMLAttributes<HTMLDivElement> {
    html: string;
  }

  class DangerouslySetHtmlContent extends React.Component<DangerouslySetHtmlContentProps, any> {}

  export = DangerouslySetHtmlContent;
}
