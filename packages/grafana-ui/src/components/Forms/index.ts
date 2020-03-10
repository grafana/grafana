import { Controller as InputControl } from 'react-hook-form';
import { getFormStyles } from './getFormStyles';
import { Label } from './Label';
import { Input } from './Input/Input';
import { ButtonSelect } from './Select/ButtonSelect';
import { RadioButtonGroup } from './RadioButtonGroup/RadioButtonGroup';
import { AsyncSelect, Select, MultiSelect, AsyncMultiSelect } from './Select/Select';
import { Form } from './Form';
import { Field } from './Field';
import { Button, LinkButton } from './Button';
import { Switch } from './Switch';
import { TextArea } from './TextArea/TextArea';

const Forms = {
  RadioButtonGroup,
  Switch,
  getFormStyles,
  Label,
  Input,
  Form,
  Field,
  Button,
  LinkButton,
  Select,
  AsyncSelect,
  MultiSelect,
  AsyncMultiSelect,
  ButtonSelect,
  InputControl,
  TextArea,
};

export { ButtonVariant } from './Button';
export default Forms;
