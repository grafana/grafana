import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';

import { pluginAvailability, setupGuideEnabled } from './pluginAvailability';
import { type SignalStatus } from './solutionState';
import { type SolutionCta, type SolutionLearnMore, type SolutionOffer } from './types';

export interface SolutionOfferSpec {
  appId: string;
  description: string;
  setupHint?: string;
  /** Null when no setup destination is useful for this user. */
  setupCta: (capabilities: { setupGuideEnabled: boolean }) => Promise<SolutionCta<'setup'> | null>;
  getLearnMore?: (capabilities: { setupGuideEnabled: boolean }) => SolutionLearnMore;
}

/**
 * A disabled app can be offered after an inconclusive probe because enabling it makes no claim
 * about telemetry. Setup requires a definitive inactive signal so a failed probe never asks users
 * to re-instrument.
 */
export function solutionOffer(
  signal: () => Promise<SignalStatus>,
  spec: SolutionOfferSpec
): () => Promise<SolutionOffer | null> {
  return async () => {
    try {
      // Check the signal first so active solutions never wait for plugin inventory.
      const detected = await signal();
      if (detected === 'active') {
        return null;
      }

      const availability = await pluginAvailability();
      const entry = availability.get(spec.appId);
      if (!entry) {
        return null;
      }

      if (entry.state === 'enable') {
        const learnMore = spec.getLearnMore?.({ setupGuideEnabled: await setupGuideEnabled() });
        return {
          availability: 'enable',
          description: spec.description,
          cta: entry.canEnable
            ? {
                label: t('home.solutions.cta.enable', 'Enable'),
                href: locationUtil.assureBaseUrl(`/plugins/${spec.appId}/`),
                action: 'enable',
              }
            : null,
          ...(learnMore ? { learnMore } : {}),
        };
      }

      if (detected !== 'inactive') {
        return null;
      }

      const capabilities = { setupGuideEnabled: await setupGuideEnabled() };
      const learnMore = spec.getLearnMore?.(capabilities);
      const cta = await spec.setupCta(capabilities).catch(() => null);
      return {
        availability: 'setup',
        description: spec.description,
        setupHint: spec.setupHint,
        cta,
        ...(learnMore ? { learnMore } : {}),
      };
    } catch {
      return null;
    }
  };
}
