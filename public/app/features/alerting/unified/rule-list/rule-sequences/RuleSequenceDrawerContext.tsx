import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

import { RuleSequenceDrawer } from './RuleSequenceDrawer';

interface RuleSequenceDrawerApi {
  openRuleSequenceDrawer: (sequenceName: string, ruleUid: string) => void;
}

interface OpenRuleSequenceState {
  sequenceName: string;
  ruleUid: string;
}

const RuleSequenceDrawerContext = createContext<RuleSequenceDrawerApi>({
  openRuleSequenceDrawer: () => {},
});

interface RuleSequenceDrawerProviderProps {
  children: ReactNode;
}

export function RuleSequenceDrawerProvider({ children }: RuleSequenceDrawerProviderProps) {
  const [openSequence, setOpenSequence] = useState<OpenRuleSequenceState | null>(null);

  const openRuleSequenceDrawer = useCallback((sequenceName: string, ruleUid: string) => {
    setOpenSequence({ sequenceName, ruleUid });
  }, []);

  const api = useMemo<RuleSequenceDrawerApi>(() => ({ openRuleSequenceDrawer }), [openRuleSequenceDrawer]);

  return (
    <RuleSequenceDrawerContext.Provider value={api}>
      {children}
      {openSequence && (
        <RuleSequenceDrawer
          sequenceName={openSequence.sequenceName}
          currentRuleUid={openSequence.ruleUid}
          onClose={() => setOpenSequence(null)}
        />
      )}
    </RuleSequenceDrawerContext.Provider>
  );
}

export function useRuleSequenceDrawer(): RuleSequenceDrawerApi {
  return useContext(RuleSequenceDrawerContext);
}
