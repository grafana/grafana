
# Contribute to Grafana documentation

This guide...

## Welcome

xxxxx


### Intended audience

The intended audience for this documentation includes Grafana open source community contributors.


## Understanding the structure of Grafana documentation

All Grafana Enterprise and OSS documentation is located in the [Grafana open source project](https://github.com/grafana/grafana) GitHub repository: https://github.com/grafana/grafana/tree/main/docs/sources.

- The **sources** directory organizes content by topic areas, for example **administration** and **alerting**. 
- Topic directories include an `_index.md` file, which provides an overview of the topic, and optionally includes subtopics that provide more detail.

:::note
The `_index.md` file is required.
:::


++++++++   OLD   +++++++

The Grafana documentation is organized into topics, called _sections_. You can take a look at the current build at [grafana.com/docs/](https://grafana.com/docs/).

Each top-level section is located under the [docs/sources](/docs/sources) directory. Subsections are added by creating a subdirectory in the directory of the parent section.

+++++++++++++++++++++++++

## Ways to contribute

We're thrilled that you are considering contributing to the documentation. You can contribute content in the following ways:

- Request a change
- Edit a topic
- Write a topic
- Write a collection of topics

### Request a change

Request a change when you want to make a suggestion about a topic, but don't want to provide an edit that generates a pull request. Requesting a change gives you the freedom to express your ideas without committing language. Your suggestion can reflect a small change to wording or can reflect larger, more substantive changes.

GitHub captures your request as an **Issue** logged against the repository.

Before you begin:
- Create a GitHub account. 

To request a change, complete the following steps:

1/ While viewing the topic, click **Request a change**.

   The Issue title auto-populates with the location of the file about which you are requesting a change.

![Request a change](request-change.png)

1/ Enter a change request description.

1/ Add the **type/docs** label.

1/ Click **Submit new issue**. 

Process question: What happens next?


### Edit a topic

If you want to recommend a small change, such as suggesting alternative wording to language within a topic, you can edit the topic directly in GitHub. You are not required to fork and clone the repo to use this approach.

Other small changes might include:

- Adding steps to a task
- Adding clarifying language to a concept
- Providing an example

Before you begin:
- Create a GitHub account. 

To edit a topic, complete the following steps:

1/ While viewing the topic you want to edit, click **Edit this page**.

![Edit a topic](edit-file.png)

1/ Add your changes to the topic.

1/ Scroll to the bottom of the page and enter a branch name.
   
   For example, enter `clarified dashboard panel definition`.

1/ Click **Commit**.

   GitHub prompts you to create a PR.

1/ Complete the prompts provided in the body of the PR.

1/ Click **Create pull request**.

How much to describe the build process? What happends next?


### Write a topic

At Grafana Labs, we use the principles of topic-based authoring when we write technical documentation. Topic-based authoring considers three *types* of documentation: concept, task, and reference. Before you begin writing, establish what topic type you want to write.

#### Understanding topic types

Technical content can be divided into three topic types: concept, task, and reference.

- **Concept**: A concept topic explains *what* a feature (or idea) is, and why it is important.
- **Task**: A task topic explains *how* to complete an end user procedure in the system. Task topics contain steps.
- **Reference** A reference topic contains lookup information that a user might consult when they complete a task. Documenting a list of values with descriptions is a common kind of reference topic.

**Example**

Suppose you are writing content for a site called _Doggie handbook_. You might organize your topics like this: 

**Concepts**

- What a dog is
- Brief history of dogs
- Why you might want a dog
- Tasks dogs can be trained to do

**Tasks**

- Feed the dog
- Groom the dog
- Train the dog

**References**

- List of dog equipment you will need
- Table of breeds that includes breed name, size range, short or long hair, and type of dog


#### Use a documentation template to contribute a topic

We have provided documentation templates that align with each topic type:

- [Concept](link)
- [Task](link)
- [Reference](link)

Each template provides additional usage and formatting guidelines. We recommend that you make a copy of whichever template you are using, and add content.

After you push your changes and create a PR, the docs build system automatically conducts a series of tests to ensure that the content doesn't conflict with other content.

#### View a local build

Prior to pushing your changes, you can view a local build of the documentation so that you can review your work.

To view a local build:

1/ Install Docker.

1/ Run Docker.

1/ Navigate to the **docs** root directory.

1/ Run `make build`.

1/ Open `localhost:3002` to review your changes.

Introduction to the templates, where they are located, etc, that written in MD (refer to or include common md elements we use), refer them to the commented text for specific usage guidelines, mention how to preview docs locally to check work.

+++++++
What about adding a new topic directory and creating the index file as the overview OR could be providing a new subtopic.
+++++



#### The writing process

We recommend that you fork and clone the Grafana repository so that you can use a text editor locally to create branches, commit your changes, and create a PR.

While this document doesn't address git and GitHub specific operations, you might find these links useful.

- [Install git]()
- [Fork a repo]()
- [Clone a repo]()
- [Create branches]()
- [Create a PR]()

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
