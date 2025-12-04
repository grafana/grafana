export const getFieldTypeIcon = (mysqlType: string) => {
  switch (mysqlType.toLowerCase()) {
    case 'text':
      return 'font';
    case 'double':
    case 'float':
    case 'int':
    case 'bigint':
      return 'calculator-alt';
    case 'datetime':
    case 'timestamp':
      return 'clock-nine';
    case 'boolean':
      return 'toggle-on';
    default:
      return 'question-circle';
  }
};
