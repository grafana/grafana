export type GroupConditionVisibility = 'show' | 'hide';
export type GroupConditionCondition = 'and' | 'or';
// Condition type identifier - matches the id from ConditionRegistryItem.
// Open string type because the condition registry is extensible.
export type GroupConditionConditionType = string;
