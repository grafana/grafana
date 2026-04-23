import { useCallback, useMemo, useState } from 'react';

import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { type StateChip, type StateChipCounts, type TreeModel, getStateBucket } from '../lib/types';

export interface UseStateChipFilterResult {
  active: Set<StateChip>;
  counts: StateChipCounts;
  toggle: (chip: StateChip) => void;
  clear: () => void;
  applyToTree: (tree: TreeModel) => TreeModel;
  hasActiveChips: boolean;
}

const EMPTY_COUNTS: StateChipCounts = { firing: 0, pending: 0, recovering: 0, normal: 0 };

export function useStateChipFilter(preStateTree: TreeModel): UseStateChipFilterResult {
  const [active, setActive] = useState<Set<StateChip>>(() => new Set());

  const counts = useMemo<StateChipCounts>(() => {
    const next: StateChipCounts = { ...EMPTY_COUNTS };
    for (const ds of preStateTree.dataSources) {
      for (const folder of ds.folders) {
        for (const group of folder.groups) {
          for (const rule of group.rules) {
            if (rule.type !== 'alerting') {
              continue;
            }
            const bucket = getStateBucket(rule.state);
            if (bucket) {
              next[bucket] += 1;
            }
          }
        }
      }
    }
    return next;
  }, [preStateTree]);

  const toggle = useCallback((chip: StateChip) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) {
        next.delete(chip);
      } else {
        next.add(chip);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setActive(new Set()), []);

  const applyToTree = useCallback(
    (tree: TreeModel): TreeModel => {
      if (active.size === 0) {
        return tree;
      }
      const wanted: PromAlertingRuleState[] = [];
      active.forEach((chip) => {
        const state = chipToState(chip);
        if (state) {
          wanted.push(state);
        }
      });
      return {
        dataSources: tree.dataSources.map((ds) => ({
          ...ds,
          folders: ds.folders
            .map((folder) => ({
              ...folder,
              groups: folder.groups
                .map((group) => ({
                  ...group,
                  rules: group.rules.filter((rule) => {
                    if (rule.type !== 'alerting') {
                      return false;
                    }
                    return wanted.includes(rule.state);
                  }),
                }))
                .filter((g) => g.rules.length > 0),
            }))
            .filter((f) => f.groups.length > 0 || Boolean(ds.error)),
        })),
      };
    },
    [active]
  );

  return { active, counts, toggle, clear, applyToTree, hasActiveChips: active.size > 0 };
}

function chipToState(chip: StateChip): PromAlertingRuleState | undefined {
  switch (chip) {
    case 'firing':
      return PromAlertingRuleState.Firing;
    case 'pending':
      return PromAlertingRuleState.Pending;
    case 'recovering':
      return PromAlertingRuleState.Recovering;
    case 'normal':
      return PromAlertingRuleState.Inactive;
    default:
      return undefined;
  }
}
