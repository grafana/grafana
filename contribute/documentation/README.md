
# Contribute to Grafana documentation

This guide...

## Welcome

xxxxx


### Intended audience

xxx...


## Understanding the structure of Grafana documentation

All Grafana Enterprise and OSS documentation is located in the current repository (the repository you are currently in) at 

After you expand sources, you will see directories, for example `administration` and `alerting`.
The Grafana documentation is organized into topics, called _sections_. You can take a look at the current build at [grafana.com/docs/](https://grafana.com/docs/).

Each top-level section is located under the [docs/sources](/docs/sources) directory. Subsections are added by creating a subdirectory in the directory of the parent section.

For each section, an `_index.md` file provides an overview of the topic.


## Ways to contribute

xxxx.


### Edit a topic

Task topic for editing directly in GH, branching and PR, but no fork and clone. Great for small changes. Uses some of the content here, a bit under Your first contribution. https://github.com/grafana/grafana/blob/main/contribute/documentation.md. Add that ya need GH account as prereq..

### Write a topic

xxx.

#### Understanding topic types

Include the chunking information in https://github.com/grafana/grafana/blob/main/contribute/templates/README.md

#### Use a documentation template to contribute a topic

Introduction to the templates, where they are located, etc, that written in MD (refer to or include common md elements we use), refer them to the commented text for specific usage guidelines, mention branch, commit, and create PR actions, mention how to preview docs locally to check work.

### Write a collection of topics

Not sure if this needs more than to say 'use your topic writing skills and get with us to determine IA for bulk content'. 


## Understanding the PR review and approval workflow

Describe where to post PR for review, and what the review process is like. This doesn't have to be long.

## Join our community

From here, but expand on this, if possible: https://github.com/grafana/grafana/blob/main/contribute/documentation.md

## Reference: Top five writing tips

xxxx.



++++++++++++++++++++++++++++++++++
# Templates

Templates are both a starting point and an instruction manual for writing something new. They are intended to make life easier by providing a jumping-off point, something besides a blank page to start from. They are not intended to be a limitation. If the template does not work perfectly for your use case, you can adjust or change it. We will work it out in code review.

## Create a template

Feel free to add templates to the `templates` folder. Try to make them as generic as possible and include clear instructions for when and how to use the template. Assume that the template user is a brand new contributor and write accordingly.

## Use a template

1. Read the template. Make sure you understand what it is for and how it is intended to be used.
1. Copy and rename the template. Move it to where you actually need it.
   You might also want to copy the content of the template and paste it into a different file. This is acceptable use.
1. Replace the template content with your own. Delete whatever is unnecessary.

## Documentation templates

In an ideal world, each topic will correspond to an information _type_ ([task](doc-task-template.md), [reference](doc-reference-template.md), [concept](doc-concept-template.md)) and contain only that type of information.

However, this is not always practical. For example, you have a series of short topics, you can group them into one topic.

Try to _chunk_ your content. This means you should organize the document so that the same kinds of content are grouped together.

### Chunking example

If I was writing content for a site called _Doggie handbook_, I might organize it like this.

**Concept**

- What a dog is
- Brief history of dogs
- Why you might want a dog
- Tasks dogs can be trained to do

**Tasks**

- Feed the dog
- Groom the dog
- Train the dog

**Reference**

- List of dog equipment you will need
- Table of breeds that includes breed name, size range, short or long hair, and type of dog

### Audience

Write for an audience that is computer literate and has general technical knowledge, but is not necessarily familiar with Grafana or the finer points of observability.

Pretend you are explaining your topic to a brand new Grafana user or developer.

### Self-contained

Thanks to search engines, every page in the documentation might be a reader's entry point. This means that each page needs to be self-contained and make sense on its own. The reader should not need to read other topics in order to perform the task or understand the concept.

However, try to be helpful and link to related information. Using the _Doggie handbook_ example, the concept topic that explains what dogs can be trained to do might link to the Train the dog task.

## Code templates

This is a placeholder for future templates.
