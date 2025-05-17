export function getOperationParamId(operationId: string, paramIndex: number) {
  return `operations.${operationId}.param.${paramIndex}`;
}
