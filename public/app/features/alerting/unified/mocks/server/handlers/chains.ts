import { HttpResponse, http } from 'msw';

import {
  DEV_DEMO_CHAIN_FOLDER_UID,
  DEV_DEMO_CHAIN_GROUP_NAME,
  DEV_DEMO_CHAIN_ID,
} from '../../../api/ruleGroupChainsApi';
import { alertingFactory } from '../db';

const listRuleGroupChainsHandler = () =>
  http.get('/api/ruler/grafana/api/v1/chains', ({ request }) => {
    const folderUid = new URL(request.url).searchParams.get('folder_uid') ?? DEV_DEMO_CHAIN_FOLDER_UID;
    if (folderUid !== DEV_DEMO_CHAIN_FOLDER_UID) {
      return HttpResponse.json({ chains: [] });
    }
    const chains = [
      alertingFactory.chain.build({
        id: DEV_DEMO_CHAIN_ID,
        folderUid,
        groupName: DEV_DEMO_CHAIN_GROUP_NAME,
        name: 'Chain rail demo',
        mode: 'Sequential',
        interval: '1m',
      }),
    ];
    return HttpResponse.json({ chains });
  });

const handlers = [listRuleGroupChainsHandler()];

export default handlers;
