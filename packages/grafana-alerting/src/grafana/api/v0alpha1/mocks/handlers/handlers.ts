import { createReceiverHandler } from './ReceiverHandlers/createReceiverHandler';
import { deleteReceiverHandler } from './ReceiverHandlers/deleteReceiverHandler';
import { deletecollectionReceiverHandler } from './ReceiverHandlers/deletecollectionReceiverHandler';
import { getReceiverHandler } from './ReceiverHandlers/getReceiverHandler';
import { listReceiverHandler } from './ReceiverHandlers/listReceiverHandler';
import { replaceReceiverHandler } from './ReceiverHandlers/replaceReceiverHandler';
import { updateReceiverHandler } from './ReceiverHandlers/updateReceiverHandler';

export const handlers = [
  listReceiverHandler(),
  createReceiverHandler(),
  deletecollectionReceiverHandler(),
  getReceiverHandler(),
  replaceReceiverHandler(),
  deleteReceiverHandler(),
  updateReceiverHandler(),
] as const;
