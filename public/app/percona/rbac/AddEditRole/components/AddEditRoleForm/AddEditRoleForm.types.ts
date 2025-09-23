export interface AddEditFormValues {
  title: string;
  description?: string;
  filter: string;
}

export interface AddEditRoleFormProps {
  isLoading?: boolean;
  initialValues?: AddEditFormValues;
  title: string;
  cancelLabel: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (values: AddEditFormValues) => void;
}
