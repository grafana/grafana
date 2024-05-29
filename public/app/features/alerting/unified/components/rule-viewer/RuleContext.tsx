import * as React from 'react';

import { CombinedRule, RuleIdentifier } from 'app/types/unified-alerting';

interface Context {
  rule: CombinedRule;
  identifier: RuleIdentifier;
}

const AlertRuleContext = React.createContext<Context | undefined>(undefined);

type Props = Context & React.PropsWithChildren & {};

const AlertRuleProvider = ({ children, rule, identifier }: Props) => {
  const value: Context = {
    rule,
    identifier,
  };

  return <AlertRuleContext.Provider value={value}>{children}</AlertRuleContext.Provider>;
};

const useAlertRule = () => {
  const context = React.useContext(AlertRuleContext);

  if (context === undefined) {
    throw new Error('useAlertRule must be used within a AlertRuleContext');
  }

  return context;
};

export { AlertRuleProvider, useAlertRule };
