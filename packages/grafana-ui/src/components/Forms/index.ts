import { Controller as InputControl } from 'react-hook-form';
import { getFormStyles } from './getFormStyles';
import { Label } from './Label';
import { Input } from './Input/Input';
import { ButtonSelect } from './Select/ButtonSelect';
import { RadioButtonGroup } from './RadioButtonGroup/RadioButtonGroup';
import { AsyncSelect, Select } from './Select/Select';
import { Form } from './Form';
import { Field } from './Field';
import { Switch } from './Switch';
import { TextArea } from './TextArea/TextArea';
import { Checkbox } from './Checkbox';
//Will be removed after Enterprise changes have been merged
import { Button, LinkButton } from '../Button';

const Forms = {
  RadioButtonGroup,
  Button,
  LinkButton,
  Switch,
  getFormStyles,
  Label,
  Input,
  Form,
  Field,
  Select,
  ButtonSelect,
  InputControl,
  AsyncSelect,
  TextArea,
  Checkbox,
};

export default Forms;
