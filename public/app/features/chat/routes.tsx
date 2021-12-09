import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
import { RouteDescriptor } from 'app/core/navigation/types';

const chatRoutes = [
  {
    path: '/chat',
    // eslint-disable-next-line react/display-name
    component: SafeDynamicImport(() => import(/* webpackChunkName: "ChatIndex" */ 'app/features/chat/ChatIndex')),
  },
];

export function getChatRoutes(cfg = config): RouteDescriptor[] {
  return chatRoutes;
}
