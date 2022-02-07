import React from 'react';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { Chat } from '../../../../packages/grafana-runtime';

export default function ChatIndex() {
  const navModel = useNavModel('chat');

  return (
    <Page navModel={navModel}>
      <Page.Contents className="chat-wrapper">
        <Chat contentTypeId={1} objectId={'1'} />
      </Page.Contents>
    </Page>
  );
}
