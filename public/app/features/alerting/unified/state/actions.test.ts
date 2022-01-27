import { RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';
import { getUniqueGroupName } from './actions';

describe('getUniqueGroupName', () => {
  it('Should return the original value when there are no duplicates', () => {
    // Arrange
    const originalGroupName = 'file-system-out-of-space';
    const existingGroups: RulerRuleGroupDTO[] = [];

    // Act
    const groupName = getUniqueGroupName(originalGroupName, existingGroups);

    // Assert
    expect(groupName).toBe(originalGroupName);
  });

  it('Should increment suffix counter until a unique name created', () => {
    // Arrange
    const originalGroupName = 'file-system-out-of-space';
    const existingGroups: RulerRuleGroupDTO[] = [
      { name: 'file-system-out-of-space', rules: [] },
      { name: 'file-system-out-of-space-2', rules: [] },
    ];

    // Act
    const groupName = getUniqueGroupName(originalGroupName, existingGroups);

    // Assert
    expect(groupName).toBe('file-system-out-of-space-3');
  });
});
