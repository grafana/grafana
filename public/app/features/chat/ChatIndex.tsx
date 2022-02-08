import React from 'react';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { Chat } from 'app/features/chat/Chat';
import { contextSrv } from 'app/core/services/context_srv';

export default function ChatIndex() {
  const navModel = useNavModel('chat');

  return (
    <Page navModel={navModel}>
      <Page.Contents className="chat-wrapper">
        {/* TODO: pass proper organization ID as objectId */}
        <Chat contentTypeId={1} objectId={contextSrv.user.orgId.toString()} />
      </Page.Contents>
    </Page>
  );
}
