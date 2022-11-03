import inquirer, {
  Question,
  InputQuestion,
  CheckboxQuestion,
  NumberQuestion,
  PasswordQuestion,
  EditorQuestion,
  ConfirmQuestion,
  ListQuestion,
  ChoiceOptions,
} from 'inquirer';

type QuestionWithValidation<A extends inquirer.Answers = inquirer.Answers> =
  | InputQuestion<A>
  | CheckboxQuestion<A>
  | NumberQuestion<A>
  | PasswordQuestion<A>
  | EditorQuestion<A>;

export const answerRequired = <A extends inquirer.Answers>(question: QuestionWithValidation<A>): Question<A> => {
  return {
    ...question,
    validate: (answer: A) => answer.trim() !== '' || `${question.name} is required`,
  };
};

export const promptInput = <A extends inquirer.Answers>(
  name: string,
  message: string | ((answers: A) => string),
  required = false,
  def: any = undefined,
  when: boolean | ((answers: A) => boolean | Promise<boolean>) = true
) => {
  const model: InputQuestion<A> = {
    type: 'input',
    name,
    message,
    default: def,
    when,
  };

  return required ? answerRequired(model) : model;
};

export const promptList = <A extends inquirer.Answers>(
  name: string,
  message: string | ((answers: A) => string),
  choices: () => ChoiceOptions[],
  def: any = undefined,
  when: boolean | ((answers: A) => boolean | Promise<boolean>) = true
) => {
  const model: ListQuestion<A> = {
    type: 'list',
    name,
    message,
    choices,
    default: def,
    when,
  };

  return model;
};

export const promptConfirm = <A extends inquirer.Answers>(
  name: string,
  message: string | ((answers: A) => string),
  def: any = undefined,
  when: boolean | ((answers: A) => boolean | Promise<boolean>) = true
) => {
  const model: ConfirmQuestion<A> = {
    type: 'confirm',
    name,
    message,
    default: def,
    when,
  };

  return model;
};
