import type {
  EmailIntegration,
  OnCallIntegration,
  Receiver,
  ReceiverIntegration,
  SlackIntegration,
  GenericIntegration as UnknownIntegration,
} from './api.gen';

export type Integration = ReceiverIntegration;
export type ContactPoint = Receiver;

export type KnownIntegration = EmailIntegration | SlackIntegration | OnCallIntegration;

/**
 * Type guard to check if an integration is an EmailIntegration
 */
export function isEmailIntegration(integration: ReceiverIntegration): integration is EmailIntegration {
  return integration.type === 'email';
}

/**
 * Type guard to check if an integration is a SlackIntegration
 */
export function isSlackIntegration(integration: ReceiverIntegration): integration is SlackIntegration {
  return integration.type === 'slack';
}

/**
 * Type guard to check if an integration is an OnCallIntegration
 */
export function isOnCallIntegration(integration: ReceiverIntegration): integration is OnCallIntegration {
  return integration.type === 'OnCall';
}

/**
 * Type guard to check if an integration is a GenericIntegration
 */
export function isGenericIntegration(integration: ReceiverIntegration): integration is UnknownIntegration {
  return !isKnownIntegration(integration);
}

/**
 * Type guard to check if an integration is one of the known specific types
 */
export function isKnownIntegration(integration: ReceiverIntegration): integration is KnownIntegration {
  return isEmailIntegration(integration) || isSlackIntegration(integration) || isOnCallIntegration(integration);
}
